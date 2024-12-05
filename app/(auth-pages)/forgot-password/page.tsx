import { forgotPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function ForgotPassword({
                                           searchParams,
                                       }: {
    searchParams: Message;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-center mb-8 dark:text-white">Reset Password</h2>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
                    Enter your email address and we'll send you a temporary password to reset your account.
                </p>

                <form className="space-y-6">
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

                    <SubmitButton formAction={forgotPasswordAction} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Send Reset Link
                    </SubmitButton>
                </form>

                <p className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    Remember your password?{" "}
                    <Link href="/sign-in" className="font-medium text-blue-600 hover:text-blue-500">
                        Sign in
                    </Link>
                </p>

                <FormMessage message={searchParams} />
            </div>
        </div>
    );
}
