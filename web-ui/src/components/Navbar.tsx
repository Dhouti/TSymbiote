export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-gray-800/90 backdrop-blur-md border-b border-gray-700 z-50">
      <div className="flex justify-between items-center h-16 px-6">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-white">
            TSymbiote
          </h1>
        </div>
      </div>
    </nav>
  );
}
