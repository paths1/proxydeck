
const CircleIcon = ({ 
  width = 16, 
  height = 16, 
  fill = "currentColor",
  className = "",
  ...props 
}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={width} 
    height={height} 
    viewBox="0 0 24 24" 
    fill={fill}
    className={className}
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
  </svg>
);

export default CircleIcon;