import { RecuperarPinContent } from "./recuperar-pin-form";

export default async function RecuperarPinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return <RecuperarPinContent token={params.token} />;
}
