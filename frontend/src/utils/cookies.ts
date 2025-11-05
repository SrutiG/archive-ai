// Cookie utility functions

const COOKIE_NAME = 'archive_current_user';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

export const setCookie = (name: string, value: string, maxAge: number = COOKIE_MAX_AGE): void => {
  const expires = new Date();
  expires.setTime(expires.getTime() + maxAge * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
};

export const deleteCookie = (name: string): void => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

// User-specific cookie functions
export const setUserCookie = (user: { id: string; name: string; createdAt: string }): void => {
  setCookie(COOKIE_NAME, JSON.stringify(user));
};

export const getUserCookie = (): { id: string; name: string; createdAt: string } | null => {
  const cookieValue = getCookie(COOKIE_NAME);
  if (!cookieValue) return null;
  
  try {
    return JSON.parse(cookieValue);
  } catch (error) {
    console.error('Error parsing user cookie:', error);
    deleteCookie(COOKIE_NAME);
    return null;
  }
};

export const removeUserCookie = (): void => {
  deleteCookie(COOKIE_NAME);
};

