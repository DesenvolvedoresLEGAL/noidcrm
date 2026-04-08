/// <reference types="google.maps" />
import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GOOGLE_PLACES_API_KEY = 'AIzaSyDCQgBi7RrD5csdBSC3_RFU7_1OQ18NZrs';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string) => void;
  onBlur?: () => void;
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

let googleScriptLoaded = false;
let googleScriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (googleScriptLoaded) {
      resolve();
      return;
    }

    loadCallbacks.push(resolve);

    if (googleScriptLoading) return;
    googleScriptLoading = true;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&language=pt-BR`;
    script.async = true;
    script.onload = () => {
      googleScriptLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleScriptLoading = false;
      console.error('Failed to load Google Places script');
    };
    document.head.appendChild(script);
  });
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  onBlur,
  onEnter,
  placeholder = 'Digite o endereço...',
  className,
  autoFocus = true,
}: GooglePlacesAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scriptReady, setScriptReady] = useState(googleScriptLoaded);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadGoogleScript().then(() => {
      setScriptReady(true);
      autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
    });
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteServiceRef.current || input.length < 3) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'br' },
          types: ['address'],
        },
        (results, status) => {
          setIsLoading(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results as unknown as Prediction[]);
            setShowDropdown(true);
          } else {
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    },
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 300);
  };

  const handleSelectPrediction = (prediction: Prediction) => {
    const address = prediction.description;
    onChange(address);
    onSelect(address);
    setPredictions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    } else if (e.key === 'Enter' && !showDropdown) {
      e.preventDefault();
      onEnter?.();
    }
  };

  const handleBlur = () => {
    // Small delay to allow dropdown click to fire first
    setTimeout(() => {
      if (!showDropdown) {
        onBlur?.();
      }
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          placeholder={scriptReady ? placeholder : 'Carregando...'}
          disabled={!scriptReady}
          className={cn('pl-7 h-8 text-xs border-primary', className)}
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-start gap-2 border-b last:border-b-0 border-border/50"
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectPrediction(prediction);
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <span className="font-medium text-foreground block truncate">
                  {prediction.structured_formatting.main_text}
                </span>
                <span className="text-muted-foreground block truncate text-[10px]">
                  {prediction.structured_formatting.secondary_text}
                </span>
              </div>
            </button>
          ))}
          <div className="px-3 py-1 text-[9px] text-muted-foreground/60 text-right">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
