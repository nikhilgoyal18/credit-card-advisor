export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-600 via-violet-600 to-indigo-800 px-4">
      <div className="w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
