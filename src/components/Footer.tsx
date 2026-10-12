import { Plane } from 'lucide-react';
const sections = [
  { title: 'Приложение', links: [['Возможности', '#features'], ['Скриншоты', '#screenshots'], ['Скачать', '#download']] },
  { title: 'Помощь', links: [['Руководство', '#docs'], ['Синхронизация и копии', '#sync-guide'], ['Частые вопросы', '#faq']] },
];
export default function Footer() {
  return <footer className="bg-[#1a1a1a] text-gray-400 pt-12 pb-6"><div className="container-page">
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10"><div className="lg:col-span-2"><a href="#hero" className="flex items-center gap-2 mb-4 text-lg font-bold text-white"><Plane className="w-6 h-6 text-accent" />LogBook</a>
      <p className="max-w-md text-sm leading-relaxed">Формуляры авиационной техники на Windows и Android. Работа офлайн и обмен между устройствами по вашему запросу.</p></div>
      {sections.map((section) => <div key={section.title}><h3 className="font-semibold text-white mb-4">{section.title}</h3><ul className="space-y-3">{section.links.map(([label, href]) => <li key={href}><a href={href} className="text-sm hover:text-accent-300">{label}</a></li>)}</ul></div>)}
    </div><p className="pt-6 border-t border-gray-800 text-xs">© {new Date().getFullYear()} LogBook</p>
  </div></footer>;
}
