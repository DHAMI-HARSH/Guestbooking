import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  redirect("/dashboard");
}
