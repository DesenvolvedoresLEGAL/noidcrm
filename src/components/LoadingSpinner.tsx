export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[400px] animate-fade-in">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 absolute"></div>
        
        {/* Spinning ring */}
        <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin"></div>
        
        {/* Logo or icon in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
