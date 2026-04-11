/**
 * Auth layout - no sidebar, minimal styling
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Credit Card Advisor</h1>
          <p className="text-gray-600 mt-2">Find your best card for every purchase</p>
        </div>
        {children}
      </div>
    </div>
  );
}
