import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex flex-col flex-1 items-center justify-center px-4 sm:px-6 py-12">
        <LoginForm redirect={params.redirect} />
      </div>
    </div>
  );
}
