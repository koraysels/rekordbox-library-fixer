import React from 'react';
import { Database, SlidersHorizontal } from 'lucide-react';
import { WizardFrame } from './WizardFrame';

/**
 * An XML library cannot be fixed in place: an XML import adds and updates
 * tracks but never removes one or switches it to a new file. So the wizard
 * sends it to the database, or to the Advanced pages that do work on XML.
 */
export const XmlLibraryScreen: React.FC<{ onOpenDatabase: () => void; onAdvanced: () => void }> = ({
  onOpenDatabase, onAdvanced,
}) => (
  <WizardFrame
    title="This is an XML export"
    lead="The wizard works on the rekordbox database itself, because rekordbox can't remove or switch tracks when it imports an XML. Open your database instead, or use the Advanced tools on this XML."
    actions={
      <>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={onOpenDatabase}>
          <Database className="w-4 h-4" />
          Open my rekordbox database
        </button>
        <button type="button" className="btn-ghost flex items-center gap-2" onClick={onAdvanced}>
          <SlidersHorizontal className="w-4 h-4" />
          Go to Advanced
        </button>
      </>
    }
  />
);
