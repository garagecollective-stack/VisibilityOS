import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="space-y-6 text-center">
        <div>
          <h1 className="text-3xl font-bold text-white">VisibilityOS</h1>
          <p className="text-slate-400 mt-2">AI-powered SEO platform</p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}
