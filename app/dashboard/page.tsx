import {createClient} from "@/utils/supabase/server";
import {redirect} from "next/navigation";

export default async function DashboardPage() {
    const supabase = createClient();

    const {
        data: {user},
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect("/sign-in");
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
        <div className="flex-1 w-full flex flex-col gap-12">
            <div className="flex flex-col gap-2 items-start">
                <h2 className="font-bold text-2xl mb-4">Your user details</h2>
                <pre
                    className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">{JSON.stringify(combinedUserData, null, 2)}
                </pre>
            </div>
        </div>
    );
}
