export const Settings = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your API keys and preferences
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">API Keys</h2>
            <p className="text-sm text-gray-600 mb-2">
              API keys are managed through the Settings modal accessed from the chat header (click your avatar → Settings). Open the <strong>Models</strong> tab to add or remove provider keys so the backend cookies stay in sync.
            </p>
            <p className="text-sm text-gray-500">
              The same modal controls the model list used across the app, so any change there automatically updates the chat router integration.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
