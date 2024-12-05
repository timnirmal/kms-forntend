import { signUpAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function Signup({ searchParams }: { searchParams: Message }) {
    if ("message" in searchParams) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black">
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-xl w-full max-w-md">
                    <FormMessage message={searchParams} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black">
            <form className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-xl w-full max-w-md space-y-6">
                <h1 className="text-3xl font-bold text-center dark:text-white">Sign Up</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Already have an account?{" "}
                    <Link className="font-medium text-blue-600 hover:text-blue-500" href="/sign-in">
                        Sign in
                    </Link>
                </p>
                <div className="flex flex-col gap-4">
                    <div>
                        <Label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Email
                        </Label>
                        <Input
                            name="email"
                            placeholder="you@example.com"
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <Label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Password
                        </Label>
                        <Input
                            type="password"
                            name="password"
                            placeholder="Your password"
                            minLength={6}
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <SubmitButton
                        formAction={signUpAction}
                        pendingText="Signing up..."
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sign up
                    </SubmitButton>
                    <FormMessage message={searchParams} />
                </div>
            </form>
        </div>
    );
}
