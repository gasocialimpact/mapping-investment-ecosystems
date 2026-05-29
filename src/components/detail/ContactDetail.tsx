import { Mail, Star } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDetail } from '../../context/DetailContext';
import { SEGMENT_STYLES } from '../../types';

export function ContactDetail({ id }: { id: string }) {
  const { maps } = useData();
  const { open } = useDetail();
  const contact = maps.contactById.get(id);
  if (!contact) return <p className="text-sm text-slate-400">Contact not found.</p>;

  const orgs = contact.organizationIds.map((oid) => maps.orgById.get(oid)).filter(Boolean);

  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Contact</p>
      <h2 className="text-lg font-bold text-slate-800 mt-1 flex items-center gap-2">
        {contact.name}
        {contact.isKeyContact && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
      </h2>

      {contact.email && (
        <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-blue-600 mt-1">
          <Mail size={12} /> {contact.email}
        </a>
      )}

      {contact.isKeyContact && (
        <span className="inline-block mt-2 text-[10px] bg-brand-yellow-soft text-yellow-800 px-2 py-0.5 rounded-full font-medium">
          Key Contact
        </span>
      )}

      {orgs.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Organizations</h3>
          <ul className="space-y-1.5">
            {orgs.map((o) => o && (
              <li key={o.id}>
                <button
                  onClick={() => open('organization', o.id)}
                  className="w-full flex items-center gap-2 text-sm text-left border border-slate-100 rounded-md px-3 py-2 hover:border-slate-300"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: SEGMENT_STYLES[o.segment].color }} />
                  <span className="text-slate-700 truncate">{o.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
