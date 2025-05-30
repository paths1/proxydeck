import { render } from 'preact';
import './index.css';
import PopupApp from './pages/popup/PopupApp';

const container = document.getElementById('popup-root');
render(<PopupApp />, container);