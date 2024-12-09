import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import {redirect} from "next/navigation";

export default async function AuthButton() {
    const supabase = createClient();
    const {
        data: { user },
    } = await createClient().auth.getUser();

    if (!user) {
        // If no user is found, render the sign-in and sign-up options
        return (
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

    // Fetch user profile data from the 'profiles' table using the user's ID
    const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(); // Assuming there's only one profile per user ID

    if (profileError) {
        console.error('Failed to fetch user profile:', profileError);
        // Optionally handle the error, e.g., redirect or show an error message
    }

    // Combine auth and profile data for display
    const combinedUserData = {
        ...user,
        ...userProfile
    };

    return (
        <div className="flex items-center gap-4 text-gray-700 dark:text-gray-300">
            <span className="text-sm font-medium">
                Hey, <span className="font-semibold">{combinedUserData.username || 'Guest'}</span>!
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
    );
}
