// Sign-in, setup and join screens: the heading, the welcome line and the form
// all live together in one card, centered on the page.
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
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-20">
      <div className="rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-muted">{description}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
