// Kakao Maps JavaScript SDK type declarations
// autoload=false 방식: kakao.maps.load() 후 사용

declare namespace kakao.maps {
  function load(callback: () => void): void;

  namespace services {
    type Status = "OK" | "ZERO_RESULT" | "ERROR";

    interface PlaceSearchOptions {
      size?: number;
      page?: number;
      sort?: "accuracy" | "distance";
    }

    interface PlaceResult {
      id: string;
      place_name: string;
      category_name: string;
      category_group_code: string;
      category_group_name: string;
      phone: string;
      address_name: string;
      road_address_name: string;
      x: string; // longitude
      y: string; // latitude
      place_url: string;
      distance: string;
    }

    type PlacesSearchResultItem = PlaceResult;
    type PlacesSearchResult = PlaceResult[];

    type PlacesSearchCallback = (
      result: PlacesSearchResult,
      status: Status
    ) => void;

    class Places {
      keywordSearch(
        keyword: string,
        callback: PlacesSearchCallback,
        options?: PlaceSearchOptions
      ): void;
    }
  }
}

interface Window {
  kakao: typeof kakao;
}
