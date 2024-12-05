import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";

export default async function AuthButton() {
    const {
        data: { user },
    } = await createClient().auth.getUser();

    return user ? (
        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
            <span className="text-sm font-medium">
                Hey, <span className="font-semibold">{user.email}</span>!
            </span>
            <form action={signOutAction}>
                <Button
                    type="submit"
                    variant="outline"
                    className="rounded-lg px-4 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                    Sign Out
                </Button>
            </form>
        </div>
    ) : (
        <div className="flex items-center gap-4">
            <Button
                asChild
                size="sm"
                variant="outline"
                className="rounded-lg px-4 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
            >
                <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button
                asChild
                size="sm"
                variant="default"
                className="rounded-lg px-4 py-2 bg-blue-600 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                <Link href="/sign-up">Sign Up</Link>
            </Button>
        </div>
    );
}
