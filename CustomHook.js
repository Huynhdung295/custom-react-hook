import { useState, useEffect, useRef, useCallback } from "react";
import { isEqual } from "lodash";
import Cookies from "js-cookie";
import copy from "copy-to-clipboard";
import * as translations from "./translations";
// Variables
const SETTING_HEADER = {
  headers: { "Content-Type": "application/json" },
};

// Function
const useStorage = (key, defaultValue, storageObject) => {
  const [value, setValue] = useState(() => {
    const jsonValue = storageObject.getItem(key);
    if (jsonValue != null) return JSON.parse(jsonValue);

    if (typeof defaultValue === "function") {
      return defaultValue();
    } else {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (value === undefined) return storageObject.removeItem(key);
    storageObject.setItem(key, JSON.stringify(value));
  }, [key, value, storageObject]);

  const remove = useCallback(() => {
    setValue(undefined);
  }, []);

  return [value, setValue, remove];
};
const getNestedTranslation = (language, keys) =>
  keys.reduce((obj, key) => {
    return obj?.[key];
  }, translations[language]);

// Hook
const useToggle = (defaultValue) => {
  const [value, setValue] = useState(defaultValue);
  const toggleValue = (value) =>
    setValue((currentValue) =>
      typeof value === "boolean" ? value : !currentValue
    );
  return [value, toggleValue];
};
const useTimeout = (cb, delay) => {
  const callbackRef = useRef(cb);
  const timeoutRef = useRef();

  useEffect(() => {
    callbackRef.current = cb;
  }, [cb]);

  const set = useCallback(() => {
    timeoutRef.current = setTimeout(() => callbackRef.current(), delay);
  }, [delay]);

  const clear = useCallback(() => {
    timeoutRef.current && clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    set();
    return clear;
  }, [delay, set, clear]);

  const reset = useCallback(() => {
    clear();
    set();
  }, [clear, set]);

  return { reset, clear };
};
const useDebounce = (callback, delay, dependencies) => {
  const { reset, clear } = useTimeout(callback, delay);
  useEffect(reset, [...dependencies, reset]);
  useEffect(clear, []);
};
const useUpdateEffect = (callback, dependencies) => {
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    return callback();
  }, dependencies);
};
const useArray = (defaultValue) => {
  const [array, setArray] = useState(defaultValue);
  const push = (element) => setArray((a) => [...a, element]);
  const filter = (callback) => setArray((a) => a.filter(callback));
  const update = (index, newElement) =>
    setArray((a) => [
      ...a.slice(0, index),
      newElement,
      ...a.slice(index + 1, a.length),
    ]);
  const remove = (index) =>
    setArray((a) => [...a.slice(0, index), ...a.slice(index + 1, a.length)]);
  const clear = () => setArray([]);

  return { array, set: setArray, push, filter, update, remove, clear };
};
const usePrevious = (value) => {
  const currentRef = useRef(value);
  const previousRef = useRef();

  if (currentRef.current !== value) {
    previousRef.current = currentRef.current;
    currentRef.current = value;
  }

  return previousRef.current;
};
const useStateWithHistory = (defaultValue, { capacity = 10 } = {}) => {
  const [value, setValue] = useState(defaultValue);
  const historyRef = useRef([value]);
  const pointerRef = useRef(0);

  const set = useCallback(
    (v) => {
      const resolvedValue = typeof v === "function" ? v(value) : v;
      if (historyRef.current[pointerRef.current] !== resolvedValue) {
        if (pointerRef.current < historyRef.current.length - 1) {
          historyRef.current.splice(pointerRef.current + 1);
        }
        historyRef.current.push(resolvedValue);

        while (historyRef.current.length > capacity) {
          historyRef.current.shift();
        }
        pointerRef.current = historyRef.current.length - 1;
      }
      setValue(resolvedValue);
    },
    [capacity, value]
  );

  const back = useCallback(() => {
    if (pointerRef.current <= 0) return;
    pointerRef.current--;
    setValue(historyRef.current[pointerRef.current]);
  }, []);

  const forward = useCallback(() => {
    if (pointerRef.current >= historyRef.current.length - 1) return;
    pointerRef.current++;
    setValue(historyRef.current[pointerRef.current]);
  }, []);

  const go = useCallback((index) => {
    if (index < 0 || index > historyRef.current.length - 1) return;
    pointerRef.current = index;
    setValue(historyRef.current[pointerRef.current]);
  }, []);

  return [
    value,
    set,
    {
      history: historyRef.current,
      pointer: pointerRef.current,
      back,
      forward,
      go,
    },
  ];
};
const useLocalStorage = (key, defaultValue) => {
  return useStorage(key, defaultValue, window.localStorage);
};
const useSessionStorage = (key, defaultValue) => {
  return useStorage(key, defaultValue, window.sessionStorage);
};
const useAsync = (callback, dependencies = []) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [value, setValue] = useState();

  const callbackMemoized = useCallback(() => {
    setLoading(true);
    setError(undefined);
    setValue(undefined);
    callback()
      .then(setValue)
      .catch(setError)
      .finally(() => setLoading(false));
  }, dependencies);

  useEffect(() => {
    callbackMemoized();
  }, [callbackMemoized]);

  return { loading, error, value };
};
const useFetch = (url, options = {}, dependencies = []) => {
  return useAsync(() => {
    return fetch(url, { ...SETTING_HEADER, ...options }).then((res) => {
      if (res.ok) return res.json();
      return res.json().then((json) => Promise.reject(json));
    });
  }, dependencies);
};
const useScript = (url) => {
  return useAsync(() => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;

    return new Promise((resolve, reject) => {
      script.addEventListener("load", resolve);
      script.addEventListener("error", reject);
      document.body.appendChild(script);
    });
  }, [url]);
};
const useDeepCompareEffect = (callback, dependencies) => {
  const currentDependenciesRef = useRef();
  if (!isEqual(currentDependenciesRef.current, dependencies)) {
    currentDependenciesRef.current = dependencies;
  }
  useEffect(callback, [currentDependenciesRef.current]);
};
const useEventListener = (eventType, callback, element = window) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (element == null) return;
    const handler = (e) => callbackRef.current(e);
    element.addEventListener(eventType, handler);

    return () => element.removeEventListener(eventType, handler);
  }, [eventType, element]);
};
const useOnScreen = (ref, rootMargin = "0px") => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (ref.current == null) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin }
    );
    observer.observe(ref.current);
    return () => {
      if (ref.current == null) return;
      observer.unobserve(ref.current);
    };
  }, [ref.current, rootMargin]);
  return isVisible;
};
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEventListener("resize", () => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
  });
  return windowSize;
};
const useMediaQuery = (mediaQuery) => {
  const [isMatch, setIsMatch] = useState(false);
  const [mediaQueryList, setMediaQueryList] = useState(null);
  useEffect(() => {
    const list = window.matchMedia(mediaQuery);
    setMediaQueryList(list);
    setIsMatch(list.matches);
  }, [mediaQuery]);
  useEventListener("change", (e) => setIsMatch(e.matches), mediaQueryList);
  return isMatch;
};
const useGeolocation = (options) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [data, setData] = useState({});
  useEffect(() => {
    const successHandler = (e) => {
      setLoading(false);
      setError(null);
      setData(e.coords);
    };
    const errorHandler = (e) => {
      setError(e);
      setLoading(false);
    };
    navigator.geolocation.getCurrentPosition(
      successHandler,
      errorHandler,
      options
    );
    const id = navigator.geolocation.watchPosition(
      successHandler,
      errorHandler,
      options
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [options]);
  return { loading, error, data };
};
const useStateWithValidation = (validationFunc, initialValue) => {
  const [state, setState] = useState(initialValue);
  const [isValid, setIsValid] = useState(() => validationFunc(state));

  const onChange = useCallback(
    (nextState) => {
      const value =
        typeof nextState === "function" ? nextState(state) : nextState;
      setState(value);
      setIsValid(validationFunc(value));
    },
    [validationFunc]
  );

  return [state, onChange, isValid];
};
const useSize = (ref) => {
  const [size, setSize] = useState({});
  useEffect(() => {
    if (ref.current == null) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize(entry.contentRect)
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return size;
};
const useEffectOnce = (cb) => useEffect(cb, []);
const useClickOutside = (ref, cb) => {
  useEventListener(
    "click",
    (e) => {
      if (ref.current == null || ref.current.contains(e.target)) return;
      cb(e);
    },
    document
  );
};
const useDarkMode = () => {
  const [darkMode, setDarkMode] = useLocalStorage("useDarkMode");
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const enabled = darkMode ?? prefersDarkMode;
  useEffect(() => {
    document.body.classList.toggle("dark-mode", enabled);
  }, [enabled]);
  return [enabled, setDarkMode];
};
const useCopyToClipboard = () => {
  const [value, setValue] = useState();
  const [success, setSuccess] = useState();

  const copyToClipboard = (text, options) => {
    const result = copy(text, options);
    if (result) setValue(text);
    setSuccess(result);
  };

  return [copyToClipboard, { value, success }];
};
const useCookie = (name, defaultValue) => {
  const [value, setValue] = useState(() => {
    const cookie = Cookies.get(name);
    if (cookie) return cookie;
    Cookies.set(name, defaultValue);
    return defaultValue;
  });
  const updateCookie = useCallback(
    (newValue, options) => {
      Cookies.set(name, newValue, options);
      setValue(newValue);
    },
    [name]
  );
  const deleteCookie = useCallback(() => {
    Cookies.remove(name);
    setValue(null);
  }, [name]);
  return [value, updateCookie, deleteCookie];
};
const useTranslation = () => {
  const [language, setLanguage] = useLocalStorage("language", "en");
  const [fallbackLanguage, setFallbackLanguage] = useLocalStorage(
    "fallbackLanguage",
    "en"
  );
  const translate = (key) => {
    const keys = key.split(".");
    return (
      getNestedTranslation(language, keys) ??
      getNestedTranslation(fallbackLanguage, keys) ??
      key
    );
  };
  return {
    language,
    setLanguage,
    fallbackLanguage,
    setFallbackLanguage,
    t: translate,
  };
};
const useOnlineStatus = () => {
  const [online, setOnline] = useState(navigator.onLine);
  useEventListener("online", () => setOnline(navigator.onLine));
  useEventListener("offline", () => setOnline(navigator.onLine));
  return online;
};
const useRenderCount = () => {
  const count = useRef(1);
  useEffect(() => count.current++);
  return count.current;
};
const useDebugInformation = (componentName, props) => {
  const count = useRenderCount();
  const changedProps = useRef({});
  const previousProps = useRef(props);
  const lastRenderTimestamp = useRef(Date.now());
  const propKeys = Object.keys({ ...props, ...previousProps });
  changedProps.current = propKeys.reduce((obj, key) => {
    if (props[key] === previousProps.current[key]) return obj;
    return {
      ...obj,
      [key]: { previous: previousProps.current[key], current: props[key] },
    };
  }, {});
  const info = {
    count,
    changedProps: changedProps.current,
    timeSinceLastRender: Date.now() - lastRenderTimestamp.current,
    lastRenderTimestamp: lastRenderTimestamp.current,
  };
  useEffect(() => {
    previousProps.current = props;
    lastRenderTimestamp.current = Date.now();
    console.log("[debug-info]", componentName, info);
  });

  return info;
};
const useHover = (ref) => {
  const [hovered, setHovered] = useState(false);

  useEventListener("mouseover", () => setHovered(true), ref.current);
  useEventListener("mouseout", () => setHovered(false), ref.current);

  return hovered;
};
const useLongPress = (ref, cb, { delay = 250 } = {}) => {
  const { reset, clear } = useTimeout(cb, delay);
  useEffectOnce(clear);
  useEventListener("mousedown", reset, ref.current);
  useEventListener("touchstart", reset, ref.current);
  useEventListener("mouseup", clear, ref.current);
  useEventListener("mouseleave", clear, ref.current);
  useEventListener("touchend", clear, ref.current);
};
// Export
export {
  useToggle,
  useTimeout,
  useDebounce,
  useUpdateEffect,
  useArray,
  usePrevious,
  useStateWithHistory,
  useLocalStorage,
  useSessionStorage,
  useAsync,
  useFetch,
  useScript,
  useDeepCompareEffect,
  useEventListener,
  useOnScreen,
  useWindowSize,
  useMediaQuery,
  useGeolocation,
  useStateWithValidation,
  useSize,
  useEffectOnce,
  useClickOutside,
  useDarkMode,
  useCopyToClipboard,
  useCookie,
  useTranslation,
  useOnlineStatus,
  useRenderCount,
  useDebugInformation,
  useHover,
  useLongPress,
};
