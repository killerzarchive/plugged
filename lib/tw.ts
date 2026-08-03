import twrnc from 'twrnc';

// Font weight mapping for Roobert
const fontWeightMap: Record<string, string> = {
  'font-light': 'Roobert-Light',
  'font-normal': 'Roobert-Regular',
  'font-medium': 'Roobert-Medium',
  'font-semibold': 'Roobert-SemiBold',
  'font-bold': 'Roobert-Bold',
  'font-heavy': 'Roobert-Heavy',
  // Also support the custom class names
  'font-roobert-light': 'Roobert-Light',
  'font-roobert': 'Roobert-Regular',
  'font-roobert-medium': 'Roobert-Medium',
  'font-roobert-semibold': 'Roobert-SemiBold',
  'font-roobert-bold': 'Roobert-Bold',
  'font-roobert-heavy': 'Roobert-Heavy',
};

// Create tw instance
const tw = twrnc;

// Wrap the style method to inject Roobert font by default
const originalStyle = tw.style.bind(tw);
tw.style = (...args: any[]) => {
  const styles = originalStyle(...args);
  
  // Check if any font weight class is used
  let fontFamily = 'Roobert-Regular'; // default
  const classString = args.join(' ');
  
  for (const [className, font] of Object.entries(fontWeightMap)) {
    if (classString.includes(className)) {
      fontFamily = font;
      break;
    }
  }
  
  return {
    ...styles,
    fontFamily,
  };
};

export default tw;
