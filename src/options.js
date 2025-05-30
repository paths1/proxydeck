import { render } from 'preact';
import './index.css';
import OptionsApp from './pages/options/OptionsApp';

const container = document.getElementById('options-root');
render(<OptionsApp />, container);