import { useWorkout } from './hooks/useWorkouts';
import { WorkoutView } from './components/WorkoutView';
import './App.css';

function App() {
  const [workout, setWorkout] = useWorkout();

  return (
    <div className="app">
      <WorkoutView workout={workout} onUpdate={setWorkout} />
    </div>
  );
}

export default App;
