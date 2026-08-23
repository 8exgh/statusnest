export default function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-10">
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
