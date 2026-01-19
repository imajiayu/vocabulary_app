import { ref, watch, Ref } from 'vue'

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    read: (value: string) => T
    write: (value: T) => string
  }
): [Ref<T>, (value: T) => void] {
  const defaultSerializer = {
    read: (value: string) => {
      try {
        return JSON.parse(value)
      } catch {
        return value as T
      }
    },
    write: (value: T) => {
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }
  }

  const ser = serializer || defaultSerializer

  const storedValue = localStorage.getItem(key)
  const initialValue = storedValue !== null
    ? ser.read(storedValue)
    : defaultValue

  const state = ref(initialValue) as Ref<T>

  const setState = (value: T) => {
    state.value = value
    localStorage.setItem(key, ser.write(value))
  }

  // Watch for changes and sync to localStorage
  watch(
    state,
    (newValue) => {
      localStorage.setItem(key, ser.write(newValue))
    },
    { deep: true }
  )

  return [state, setState] as const
}

// Specialized hooks for common patterns
export function useLocalStorageBoolean(key: string, defaultValue = false) {
  return useLocalStorage(key, defaultValue, {
    read: (value: string) => value === 'true',
    write: (value: boolean) => String(value)
  })
}

export function useLocalStorageString(key: string, defaultValue = '') {
  return useLocalStorage(key, defaultValue, {
    read: (value: string) => value,
    write: (value: string) => value
  })
}

export function useLocalStorageNumber(key: string, defaultValue = 0) {
  return useLocalStorage(key, defaultValue, {
    read: (value: string) => Number(value) || defaultValue,
    write: (value: number) => String(value)
  })
}