export default function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-muted">{description}</p>
      )}
      <div className="mt-6 rounded-xl border border-border bg-background p-5 shadow-sm">
        {children}
      </div>
    </main>
  );
}
