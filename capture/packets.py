"""F1 25 UDP packet definitions and parsers.

Based on the F1 25 UDP specification. All structs are little-endian packed.
Port: 20777
"""

import struct

# --- Packet IDs --------------------------------------------------
PACKET_MOTION = 0
PACKET_SESSION = 1
PACKET_LAP_DATA = 2
PACKET_EVENT = 3
PACKET_PARTICIPANTS = 4
PACKET_CAR_SETUPS = 5
PACKET_CAR_TELEMETRY = 6
PACKET_CAR_STATUS = 7
PACKET_FINAL_CLASSIFICATION = 8
PACKET_LOBBY_INFO = 9
PACKET_CAR_DAMAGE = 10
PACKET_SESSION_HISTORY = 11
PACKET_TYRE_SETS = 12
PACKET_MOTION_EX = 13
PACKET_TIME_TRIAL = 14
PACKET_LAP_POSITIONS = 15

# --- Header ------------------------------------------------------
# All packets start with this header
HEADER_FORMAT = '<HBBBBBQfIIBB'
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)


def parse_header(data):
    """Parse the packet header. Returns dict with packet metadata."""
    fields = struct.unpack_from(HEADER_FORMAT, data, 0)
    return {
        'packet_format': fields[0],     # e.g. 2025
        'game_year': fields[1],
        'game_major_version': fields[2],
        'game_minor_version': fields[3],
        'packet_version': fields[4],
        'packet_id': fields[5],
        'session_uid': fields[6],
        'session_time': fields[7],
        'frame_id': fields[8],
        'overall_frame_id': fields[9],
        'player_car_index': fields[10],
        'secondary_player_car_index': fields[11],
    }


# --- Participants (Packet ID 4) ----------------------------------
# After header: 1 byte numActiveCars, then 22 x ParticipantData (F1 25).
#
# F1 25 ParticipantData = 60 bytes:
#   u8  m_aiControlled
#   u8  m_driverId
#   u8  m_networkId        <- added in F1 24
#   u8  m_teamId
#   u8  m_myTeam           <- added in F1 23
#   u8  m_raceNumber
#   u8  m_nationality
#   char m_name[48]
#   u8  m_yourTelemetry    <- 1 = PUBLIC (name + telemetry shared)
#   u8  m_showOnlineNames
#   u16 m_techLevel        <- added in F1 24
#   u8  m_platform
#
# Privacy gotcha: if a player's "Your Telemetry" privacy setting is
# RESTRICTED (default on some platforms), m_name will be "Player" /
# generic regardless of struct correctness. Each league member needs
# to set Telemetry -> "Your Telemetry: Public" in F1 25 -> Settings ->
# Telemetry Settings, or the name field is masked at the source.
PARTICIPANT_FORMAT = '<BBBBBBB48sBBHB'
PARTICIPANT_SIZE = struct.calcsize(PARTICIPANT_FORMAT)
assert PARTICIPANT_SIZE == 60, f"ParticipantData should be 60 bytes for F1 25, got {PARTICIPANT_SIZE}"

# Platform code -> label. Helps in debug output / sidecar dumps.
PLATFORM = {
    1: 'steam',
    3: 'playstation',
    4: 'xbox',
    6: 'origin',
    255: 'unknown',
}


def parse_participants(data):
    """Parse Participants packet. Returns list of participant dicts."""
    offset = HEADER_SIZE
    num_active = struct.unpack_from('<B', data, offset)[0]
    offset += 1

    participants = []
    for i in range(min(num_active, 22)):
        try:
            fields = struct.unpack_from(PARTICIPANT_FORMAT, data, offset + i * PARTICIPANT_SIZE)
            name_bytes = fields[7]
            name = name_bytes.split(b'\x00')[0].decode('utf-8', errors='replace').strip()

            participants.append({
                'index':             i,
                'ai_controlled':     fields[0],
                'driver_id':         fields[1],
                'network_id':        fields[2],
                'team_id':           fields[3],
                'my_team':           fields[4],
                'race_number':       fields[5],
                'nationality':       fields[6],
                'name':              name,
                'your_telemetry':    fields[8],
                'show_online_names': fields[9],
                'tech_level':        fields[10],
                'platform':          fields[11],
                'platform_label':    PLATFORM.get(fields[11], f'p{fields[11]}'),
            })
        except struct.error:
            break

    return participants


# --- Final Classification (Packet ID 8) --------------------------
# After header: 1 byte numCars, then 22 x FinalClassificationData
# Each entry: position(B), numLaps(B), gridPosition(B), points(B),
#             numPitStops(B), resultStatus(B), resultReason(B),
#             bestLapTimeInMS(I), totalRaceTime(d), penaltiesTime(B),
#             numPenalties(B), numTyreStints(B),
#             tyreStintsActual[8](8B), tyreStintsVisual[8](8B), tyreStintsEndLaps[8](8B)
CLASSIFICATION_FORMAT = '<BBBBBBBIdBBB8B8B8B'
CLASSIFICATION_SIZE = struct.calcsize(CLASSIFICATION_FORMAT)

RESULT_STATUS = {
    0: 'invalid',
    1: 'inactive',
    2: 'active',
    3: 'finished',
    4: 'dnf',
    5: 'dsq',
    6: 'not_classified',
    7: 'retired',
}

RESULT_REASON = {
    0: '',
    1: 'Retired',
    2: '',
    3: 'Terminal damage',
    4: '',
    5: 'Not enough laps',
    6: 'Black flagged',
    7: 'Red flagged',
    8: 'Mechanical failure',
    9: 'Session skipped',
    10: 'Session simulated',
}

VISUAL_TYRE_COMPOUNDS = {
    16: 'soft',
    17: 'medium',
    18: 'hard',
    7: 'inter',
    8: 'wet',
}


def parse_final_classification(data):
    """Parse Final Classification packet. Returns list of result dicts."""
    offset = HEADER_SIZE
    num_cars = struct.unpack_from('<B', data, offset)[0]
    offset += 1

    results = []
    for i in range(min(num_cars, 22)):
        try:
            fields = struct.unpack_from(CLASSIFICATION_FORMAT, data, offset + i * CLASSIFICATION_SIZE)
        except struct.error:
            break

        position = fields[0]
        num_laps = fields[1]
        grid_position = fields[2]
        points = fields[3]
        num_pit_stops = fields[4]
        result_status = fields[5]
        result_reason_code = fields[6]
        best_lap_time_ms = fields[7]
        total_race_time = fields[8]
        penalties_time = fields[9]
        num_penalties = fields[10]
        num_tyre_stints = fields[11]

        # Tyre stints: actual[8], visual[8], end_laps[8]
        tyre_actual = list(fields[12:20])
        tyre_visual = list(fields[20:28])
        tyre_end_laps = list(fields[28:36])

        # Build tyre stint list
        stints = []
        for s in range(min(num_tyre_stints, 8)):
            compound = VISUAL_TYRE_COMPOUNDS.get(tyre_visual[s], f'unknown_{tyre_visual[s]}')
            end_lap = tyre_end_laps[s]
            start_lap = tyre_end_laps[s - 1] if s > 0 else 0
            stint_laps = end_lap - start_lap if end_lap > 0 else num_laps - start_lap

            stints.append({
                'stint_number': s + 1,
                'compound': compound,
                'laps': max(stint_laps, 0),
            })

        status_str = RESULT_STATUS.get(result_status, 'unknown')
        reason_str = RESULT_REASON.get(result_reason_code, '')

        results.append({
            'index': i,
            'position': position,
            'grid_position': grid_position,
            'laps_completed': num_laps,
            'game_points': points,
            'num_pit_stops': num_pit_stops,
            'status': status_str,
            'status_reason': reason_str,
            'best_lap_time_ms': best_lap_time_ms if best_lap_time_ms > 0 else None,
            'total_time_s': total_race_time if total_race_time > 0 else None,
            'penalties_time_s': penalties_time,
            'num_penalties': num_penalties,
            'tyre_stints': stints,
        })

    return results


# --- Session (Packet ID 1) ---------------------------------------
# We only need the session type so the listener can tell qualifying
# apart from the race. SessionData is a large packet, but the field we
# care about sits at a fixed offset right after the header.
#
# Layout after the header (F1 25 SessionData prefix):
#   u8  m_weather
#   i8  m_trackTemperature
#   i8  m_airTemperature
#   u8  m_totalLaps
#   u16 m_trackLength
#   u8  m_sessionType   <- byte we read
#
# So m_sessionType lives at HEADER_SIZE + 6.

SESSION_TYPE_NAMES = {
    0: 'unknown',
    1: 'P1', 2: 'P2', 3: 'P3', 4: 'Short P',
    5: 'Q1', 6: 'Q2', 7: 'Q3', 8: 'Short Q', 9: 'OSQ',
    10: 'SQ1', 11: 'SQ2', 12: 'SQ3', 13: 'Short SQ', 14: 'OSSQ',
    15: 'Race', 16: 'Race 2', 17: 'Race 3', 18: 'Time Trial',
}

# Any session whose lap times we want to remember as qualifying times.
# Covers regular quali (5-9) and sprint-weekend quali (10-14).
QUALI_SESSION_TYPES = {5, 6, 7, 8, 9, 10, 11, 12, 13, 14}
RACE_SESSION_TYPES = {15, 16, 17}


def parse_session_data(data):
    """Parse just the bit we care about from SessionData: the session type.
    Returns dict with session_type (int) and session_type_label (str)."""
    try:
        session_type = struct.unpack_from('<B', data, HEADER_SIZE + 6)[0]
    except struct.error:
        return None
    return {
        'session_type': session_type,
        'session_type_label': SESSION_TYPE_NAMES.get(session_type, f'type_{session_type}'),
    }


def is_quali_session(session_type):
    return session_type in QUALI_SESSION_TYPES


def is_race_session(session_type):
    return session_type in RACE_SESSION_TYPES


# --- Event (Packet ID 3) -----------------------------------------
def parse_event_code(data):
    """Parse the event code string (4 chars after header)."""
    offset = HEADER_SIZE
    code = data[offset:offset + 4].decode('utf-8', errors='replace')
    return code


def parse_fastest_lap_event(data):
    """Parse fastest lap event data. Returns driver index and lap time."""
    offset = HEADER_SIZE + 4  # after event code
    try:
        driver_index, lap_time = struct.unpack_from('<Bf', data, offset)
        return {'driver_index': driver_index, 'lap_time_s': lap_time}
    except struct.error:
        return None
