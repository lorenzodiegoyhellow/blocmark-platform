import { useEffect, useRef, useState } from "react";
import { Location } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface MapViewProps {
  locations: Location[];
  className?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}

declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

export function MapView({ 
  locations,
  className = "", 
  center = { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  zoom = 11 
}: MapViewProps) {
  console.log('MapView component rendered with center:', center, 'zoom:', zoom);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const currentInfoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load Google Maps Script
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google?.maps) {
        setIsLoading(false);
        return;
      }

      const script = document.createElement('script');
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (!apiKey) {
        setError('Google Maps API key is missing');
        setIsLoading(false);
        return;
      }

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setIsLoading(false);
      };

      script.onerror = () => {
        setError('Failed to load Google Maps');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMaps();

    return () => {
      // Cleanup not needed without callback
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps || isLoading) return;

    try {
      if (!mapInstanceRef.current) {
        const mapOptions: google.maps.MapOptions = {
          center: new google.maps.LatLng(center.lat, center.lng),
          zoom: zoom,
          minZoom: 3,  // Allow global zoom
          maxZoom: 18,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ],
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.TOP_RIGHT
          },
          gestureHandling: 'auto'  // Allow normal map interaction
        };

        mapInstanceRef.current = new google.maps.Map(mapRef.current, mapOptions);
      } else {
        // Update existing map center if center prop changes
        console.log('MapView: Updating map center to:', center);
        mapInstanceRef.current.setCenter(new google.maps.LatLng(center.lat, center.lng));
        mapInstanceRef.current.setZoom(zoom);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
    }
  }, [isLoading, center, zoom]);

  // Handle locations and markers
  useEffect(() => {
    if (!mapInstanceRef.current || isLoading) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    if (!locations.length) return;

    const geocoder = new google.maps.Geocoder();
    const bounds = new google.maps.LatLngBounds();
    let processedLocations = 0;

    locations.forEach(location => {
      if (!location.address) {
        processedLocations++;
        return;
      }

      geocoder.geocode({ address: location.address }, (results, status) => {
        processedLocations++;

        if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
          const position = results[0].geometry.location;

          // Smaller offset for better accuracy
          const offset = {
            lat: (Math.random() - 0.5) * 0.004, // ~200 meters
            lng: (Math.random() - 0.5) * 0.004
          };

          const approximatePosition = new google.maps.LatLng(
            position.lat() + offset.lat,
            position.lng() + offset.lng
          );

          bounds.extend(approximatePosition);

          const marker = new google.maps.Marker({
            position: approximatePosition,
            map: mapInstanceRef.current,
            title: location.title,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: "#FF0000",
              fillOpacity: 0.7,
              strokeWeight: 2,
              strokeColor: "#FFFFFF"
            }
          });

          markersRef.current.push(marker);

          // Helper function to extract city name from address
          const extractCityFromAddress = (address: string): string => {
            if (!address) return "Unknown";
            const parts = address.split(',');
            if (parts.length >= 2) {
              return parts[1].trim();
            }
            return parts[0].trim();
          };

          // Helper function to escape HTML to prevent XSS
          const escapeHtml = (text: string): string => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
          };

          // Create rich location card content with proper escaping
          const safeImageUrl = escapeHtml(location.imageUrl || location.images?.[0] || "https://images.unsplash.com/photo-1600585154340-be6161a56a0c");
          const safeTitle = escapeHtml(location.title || 'Untitled Location');
          const safeCity = escapeHtml(extractCityFromAddress(location.address || ''));
          const safePrice = escapeHtml(location.price?.toString() || '0');
          const safeLocationId = escapeHtml(location.id?.toString() || '');

          const locationCardContent = `
            <div class="max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
              <div class="relative">
                <img 
                  src="${safeImageUrl}" 
                  alt="${safeTitle}"
                  class="w-full h-32 object-cover"
                  style="width: 280px; height: 128px; object-fit: cover;"
                />
              </div>
              
              <div class="p-4">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="font-semibold text-lg text-gray-900 line-clamp-1" style="font-weight: 600;">
                    ${safeTitle}
                  </h3>
                  <div class="flex items-center ml-2">
                    <svg class="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span class="text-sm font-medium text-gray-600 ml-1">
                      New
                    </span>
                  </div>
                </div>
                
                <div class="text-sm text-gray-500 mb-1">
                  ${safeCity}
                </div>
                
                <div class="text-sm text-gray-500 mb-3">
                  Responds within 1 hr
                </div>
                
                <div class="flex items-center justify-between">
                  ${location.instantBook ? `
                    <div class="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-1 rounded text-xs font-medium">
                      ⚡ Instant Book
                    </div>
                  ` : '<div></div>'}
                  
                  <div class="flex items-baseline">
                    <span class="font-semibold text-xl text-gray-900">$${safePrice}</span>
                    <span class="text-sm text-gray-500">/hr</span>
                  </div>
                </div>
                
                <div class="mt-3 pt-3 border-t">
                  <button class="w-full bg-blue-600 text-white px-4 py-2 rounded font-medium text-center block hover:bg-blue-700 transition-colors"
                          onclick="window.location.href='/locations/${safeLocationId}'"
                          style="text-decoration: none; color: white; border: none; cursor: pointer;">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({
            content: locationCardContent,
            maxWidth: 300
          });

          marker.addListener('click', () => {
            // Close currently open info window if any
            if (currentInfoWindowRef.current) {
              currentInfoWindowRef.current.close();
            }
            
            // Open the new info window
            infoWindow.open(mapInstanceRef.current, marker);
            
            // Store reference to current info window
            currentInfoWindowRef.current = infoWindow;
          });
        }

        // Adjust bounds only when all locations are processed and we have markers
        if (processedLocations === locations.length && markersRef.current.length > 0) {
          mapInstanceRef.current?.fitBounds(bounds);
          const currentZoom = mapInstanceRef.current?.getZoom() || 0;
          if (currentZoom > 15) {
            mapInstanceRef.current?.setZoom(15);
          }
        }
      });
    });
  }, [locations, isLoading]);

  if (error) {
    return (
      <div className={`h-full w-full rounded-lg bg-muted flex items-center justify-center ${className}`}>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`h-full w-full rounded-lg bg-muted flex items-center justify-center ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <div ref={mapRef} className={`h-full w-full rounded-lg ${className}`} />;
}