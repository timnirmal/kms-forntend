export default async function Layout({children}: { children: React.ReactNode; }) {
    return (
        <div className="bg-amber-500">{children}</div>
    );
}
