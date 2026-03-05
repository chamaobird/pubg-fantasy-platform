import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-16 px-4">
      <div className="text-center">
        <div className="font-display font-black text-[12rem] text-accent/10 leading-none select-none">
          404
        </div>
        <h1 className="font-display font-black uppercase text-4xl text-white -mt-8 mb-4 tracking-wider">
          Target Not Found
        </h1>
        <p className="text-text-secondary font-body mb-8 max-w-md mx-auto">
          The page you're looking for has gone out-of-zone. Head back to base.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">Back to Home</Link>
          <Link to="/tournaments" className="btn-secondary">View Tournaments</Link>
        </div>
      </div>
    </div>
  )
}
