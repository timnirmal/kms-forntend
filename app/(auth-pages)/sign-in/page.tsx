import {signInAction} from "@/app/actions";
import {FormMessage, Message} from "@/components/form-message";
import {SubmitButton} from "@/components/submit-button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import Link from "next/link";

export default function Login({searchParams}: { searchParams: Message }) {
    return (
        <div className="flex h-screen">
            {/* Left side with image */}
            <div className="flex-1 bg-cover bg-center" style={{backgroundImage: "url('/img.jpg')"}}>
                {/* You can add additional content or overlay here if needed */}
            </div>

            {/* Right side with the form */}
            <div className="flex-1 flex items-center justify-center p-8">
                <form className="w-full max-w-md flex flex-col">
                    <h1 className="text-2xl font-medium">Sign in</h1>
                    <p className="text-sm text-foreground mt-2">
                        Don't have an account?{" "}
                        <Link className="text-foreground font-medium underline" href="/sign-up">
                            Sign up
                        </Link>
                    </p>
                    <div className="flex flex-col gap-2 [&>input]:mb-3 mt-8">
                        <Label htmlFor="email">Email</Label>
                        <Input name="email" placeholder="you@example.com" required/>
                        <div className="flex justify-between items-center">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                className="text-xs text-foreground underline"
                                href="/forgot-password"
                            >
                                Forgot Password?
                            </Link>
                        </div>
                        <Input
                            type="password"
                            name="password"
                            placeholder="Your password"
                            required
                        />
                        <SubmitButton pendingText="Signing In..." formAction={signInAction}>
                            Sign in
                        </SubmitButton>
                        <FormMessage message={searchParams}/>
                    </div>
                </form>
            </div>
        </div>
    );
}
