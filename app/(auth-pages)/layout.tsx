import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";

export default async function Layout({children}: { children: React.ReactNode; }) {
    const {
        data: { user },
    } = await createClient().auth.getUser();

    // if user move to dashboard
    if (user) {
        return redirect("/dashboard");
    }

    console.log(user)

    return (
        <div className="bg-amber-500">{children}
            <pre
                className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">{JSON.stringify(user, null, 2)}
                </pre>
        </div>
    );
}
