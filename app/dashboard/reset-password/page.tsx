import { resetPasswordAction } from "@/app/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ResetPassword({
                                                searchParams,
                                            }: {
    searchParams: Message;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-zinc-200 to-white dark:from-zinc-900 dark:to-black">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-xl w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-8 dark:text-white">Reset Password</h1>
                <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
                    Please enter your new password below.
                </p>
                <form className="space-y-6">
                    <div>
                        <Label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                            New Password
                        </Label>
                        <Input
                            type="password"
                            name="password"
                            placeholder="New password"
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <Label
                            htmlFor="confirmPassword"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                            Confirm Password
                        </Label>
                        <Input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm password"
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <SubmitButton
                        formAction={resetPasswordAction}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Reset Password
                    </SubmitButton>
                    <FormMessage message={searchParams} />
                </form>
            </div>
        </div>
    );
}
