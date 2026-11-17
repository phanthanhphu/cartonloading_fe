import { RouterProvider } from 'react-router-dom';
import router from 'routes';
import ThemeCustomization from 'themes';
import ScrollTop from 'components/ScrollTop';
import { LanguageProvider, useT } from './i18n/LanguageProvider';
import { ActionConfirmationProvider } from './components/confirmation/ActionConfirmationProvider';

function RouterFallback() {
  const trUi = useT();
  return <div>{trUi('Loading...')}</div>;
}

export default function App() {
  return (
    <ThemeCustomization>
      <LanguageProvider>
        <ActionConfirmationProvider>
        <ScrollTop>
          <RouterProvider router={router} fallbackElement={<RouterFallback />} />
        </ScrollTop>
        </ActionConfirmationProvider>
      </LanguageProvider>
    </ThemeCustomization>
  );
}