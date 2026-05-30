export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="light flex min-h-svh flex-1 flex-col bg-background text-foreground">
      {children}
    </div>
  );
}
