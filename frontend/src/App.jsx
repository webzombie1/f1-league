import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import DriverStandings from './pages/DriverStandings'
import ConstructorStandings from './pages/ConstructorStandings'
import Schedule from './pages/Schedule'
import RaceResult from './pages/RaceResult'
import Teams from './pages/Teams'
import TeamDetail from './pages/TeamDetail'
import DriverProfile from './pages/DriverProfile'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import ManageSeasons from './pages/admin/ManageSeasons'
import ManageTeams from './pages/admin/ManageTeams'
import ManageDrivers from './pages/admin/ManageDrivers'
import ManageSchedule from './pages/admin/ManageSchedule'
import ManageResults from './pages/admin/ManageResults'
import ManagePoints from './pages/admin/ManagePoints'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="standings" element={<DriverStandings />} />
        <Route path="standings/constructors" element={<ConstructorStandings />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="race/:raceId" element={<RaceResult />} />
        <Route path="teams" element={<Teams />} />
        <Route path="teams/:teamId" element={<TeamDetail />} />
        <Route path="driver/:driverId" element={<DriverProfile />} />
      </Route>
      <Route path="admin" element={<AdminLogin />} />
      <Route path="admin/*" element={<AdminLayout />}>
        <Route path="seasons" element={<ManageSeasons />} />
        <Route path="teams" element={<ManageTeams />} />
        <Route path="drivers" element={<ManageDrivers />} />
        <Route path="schedule" element={<ManageSchedule />} />
        <Route path="results" element={<ManageResults />} />
        <Route path="points" element={<ManagePoints />} />
      </Route>
    </Routes>
  )
}
