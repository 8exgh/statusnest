export interface FaqItem {
  question: string;
  /** Plain-text answer (also used verbatim in the FAQPage JSON-LD). */
  answer: string;
  /** Optional richer rendering; falls back to `answer`. */
  render?: React.ReactNode;
}

export default function Faq({ items }: { items: FaqItem[] }) {
  return (
    <dl className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
      {items.map((item) => (
        <div key={item.question} className="px-4 py-3">
          <dt className="font-medium text-gray-900">{item.question}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-gray-700">{item.render ?? item.answer}</dd>
        </div>
      ))}
    </dl>
  );
}
