
const DownloadIcon = ({ 
  width = 16, 
  height = 16, 
  stroke = "currentColor", 
  strokeWidth = 2,
  className = "",
  ...props 
}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={stroke} 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <path d="M3 16v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"></path>
    <path d="M7 10l5 5 5-5"></path>
    <path d="M12 15V3"></path>
  </svg>
);

export default DownloadIcon;