import { requireUser } from "@/lib/auth";
import { Workspace } from "@/components/workspace";
export const dynamic = "force-dynamic";
export default async function Dashboard() { const user = await requireUser(); return <Workspace role={user.role}/>; }
