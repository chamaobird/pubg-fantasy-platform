export default function LoadingSpinner({ size = 'md', text = null, fullscreen = false }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizes[size]} relative`}>
        <div className={`${sizes[size]} border-2 border-muted border-t-accent rounded-full animate-spin`} />
        <div className={`absolute inset-1 border border-accent/20 rounded-full`} />
      </div>
      {text && (
        <p className="font-mono text-xs text-text-secondary uppercase tracking-widest animate-pulse">
          {text}
        </p>
      )}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}
