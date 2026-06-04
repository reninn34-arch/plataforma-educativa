import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 py-12">
        <LoginForm redirect={params.redirect} />
      </div>
    </div>
  );
}
