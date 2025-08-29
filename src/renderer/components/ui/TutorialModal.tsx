import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  image: string;
  altText: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Export Your Rekordbox Library",
    description: "In Rekordbox, go to File → Library → Export collection in xml format. This creates a backup of your entire library including playlists, cues, and metadata.",
    image: "./screenshots/export-collection-as-xml.png",
    altText: "Rekordbox export collection menu"
  },
  {
    title: "Import XML Step 1",
    description: "Select the exported XML file from your computer. The file is usually saved in your Documents folder.",
    image: "./screenshots/import-xml-step-1.jpg", 
    altText: "Import XML file selection"
  },
  {
    title: "Import XML Step 2", 
    description: "Choose your import preferences and settings. You can select which data to import and how to handle conflicts.",
    image: "./screenshots/import-xml-step-2.jpg",
    altText: "Import XML preferences"
  },
  {
    title: "Import XML Step 3",
    description: "Review the import summary and confirm. Your library will be processed and ready for optimization.",
    image: "./screenshots/import-xml-step-3.jpg",
    altText: "Import XML confirmation"
  }
];

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  const step = tutorialSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-te-grey-800 border-2 border-te-grey-700 rounded-te p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-6 h-6 text-te-orange" />
            <h2 className="text-xl font-bold text-te-cream font-te-display">XML Export & Import Tutorial</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-te-grey-400 hover:text-te-cream transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex space-x-2">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-te-orange' : 'bg-te-grey-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step counter */}
        <div className="text-center mb-4">
          <span className="text-te-grey-400 text-sm font-te-mono">
            Step {currentStep + 1} of {tutorialSteps.length}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <h3 className="text-lg font-semibold text-te-cream mb-3 font-te-display">
            {step.title}
          </h3>
          
          <p className="text-te-grey-300 text-sm leading-relaxed mb-4 font-te-mono">
            {step.description}
          </p>

          {/* Screenshot */}
          <div className="flex-1 flex items-center justify-center bg-te-grey-700 rounded-te border border-te-grey-600 p-4 overflow-hidden">
            <img
              src={step.image}
              alt={step.altText}
              className="max-w-full max-h-full object-contain rounded-te"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-te-grey-700 hover:bg-te-grey-600 disabled:bg-te-grey-600 disabled:opacity-50 text-te-cream rounded-te border border-te-grey-600 transition-colors font-te-mono text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleClose}
            className="px-6 py-2 bg-te-grey-700 hover:bg-te-grey-600 text-te-cream rounded-te border border-te-grey-600 transition-colors font-te-mono text-sm"
          >
            Close
          </button>

          <button
            onClick={handleNext}
            disabled={currentStep === tutorialSteps.length - 1}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-te-orange hover:bg-te-orange/90 disabled:bg-te-grey-600 disabled:opacity-50 text-te-cream rounded-te border border-te-orange transition-colors font-te-mono text-sm"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};