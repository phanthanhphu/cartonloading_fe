import { createRoot } from 'react-dom/client';

// styles
import './index.css';
import './routes/globalApi';
// project-imports
import App from 'App';

const container = document.getElementById('root');
const root = createRoot(container);

// ==============================|| MAIN - REACT DOM RENDER  ||============================== //

root.render(<App />);

