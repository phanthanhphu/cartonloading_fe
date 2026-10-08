import { createRoot } from 'react-dom/client';

// styles
import './index.css';
import './routes/globalApi';
// project-imports
import App from 'App';

// Use the Youngone favicon already in public/logo-youngone-favicon.png.
// Keep it independent of the browser's cached favicon.ico in index.html.
document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => link.remove());
const youngoneFavicon = document.createElement('link');
youngoneFavicon.rel = 'icon';
youngoneFavicon.type = 'image/png';
youngoneFavicon.href = '/logo-youngone-favicon.png?v=20261008';
document.head.appendChild(youngoneFavicon);

const container = document.getElementById('root');
const root = createRoot(container);

// ==============================|| MAIN - REACT DOM RENDER  ||============================== //

root.render(<App />);

