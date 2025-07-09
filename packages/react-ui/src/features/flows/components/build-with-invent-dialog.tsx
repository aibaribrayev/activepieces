import React, { useState, ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { t } from 'i18next';
import { Upload, Workflow } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast, INTERNAL_ERROR_TOAST } from '@/components/ui/use-toast';
import { flowsApi } from '@/features/flows/lib/flows-api';
import { SelectFlowTemplateDialog } from '@/features/flows/components/select-flow-template-dialog';
import { ImportFlowDialog } from '@/features/flows/components/import-flow-dialog';
import { authenticationSession } from '@/lib/authentication-session';
import { FlowStatus, FlowVersionState, PopulatedFlow, TriggerType } from '@activepieces/shared';


interface BuildWithInventDialogProps {
  children: ReactNode;
  onSuccess: (flow: PopulatedFlow) => void;
  folderId?: string;
  folderName?: () => Promise<string | undefined>;
}

// Mock API call for Build with Invent
const mockInventApi = {
  generateFlow: async (prompt: string, projectId: string, folderName?: string): Promise<PopulatedFlow> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock flow data that would be returned from the API
    const mockFlow: PopulatedFlow = {
      id: `flow_${Date.now()}`,
      projectId,
      externalId: `ext_${Date.now()}`,
      folderId: null,
      status: FlowStatus.ENABLED as const,
      schedule: null,
      handshakeConfiguration: null,
      publishedVersionId: null,
      metadata: null,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: {
        id: `version_${Date.now()}`,
        flowId: `flow_${Date.now()}`,
        displayName: `AI Generated: ${prompt.substring(0, 50)}...`,
        trigger: {
            type: TriggerType.EMPTY,
            name: "kek",
            valid: true,
            displayName: "kek",
            nextAction: null,
            settings: {},
        },
        state: FlowVersionState.DRAFT as const,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        valid: true,
        connectionIds: [],
      },
    };
    
    return mockFlow;
  },
};

export const BuildWithInventDialog: React.FC<BuildWithInventDialogProps> = ({
  children,
  onSuccess,
  folderId,
  folderName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  const { mutate: buildWithInvent, isPending: isBuilding } = useMutation<
    PopulatedFlow,
    Error,
    string
  >({
    mutationFn: async (prompt: string) => {
      const projectId = authenticationSession.getProjectId()!;
      const folder = await folderName?.();
      
      // Call the mock API (replace with actual API call)
      const generatedFlow = await mockInventApi.generateFlow(prompt, projectId, folder);
      
      // Create the flow using the existing API
      const createdFlow = await flowsApi.create({
        projectId,
        displayName: generatedFlow.version.displayName,
        folderName: folder,
      });
      
      // In a real implementation, you would also update the flow with the AI-generated definition
      // await flowsApi.update(createdFlow.id, { definition: generatedFlow.version.definition });
      
      return createdFlow;
    },
    onSuccess: (flow) => {
      onSuccess(flow);
      setIsOpen(false);
      setPrompt('');
      toast({
        title: t('Flow Created'),
        description: t('Your AI-generated flow has been created successfully.'),
      });
    },
    onError: () => {
      toast(INTERNAL_ERROR_TOAST);
    },
  });
  const { mutate: createFromScratch, isPending: isCreatingFromScratch } = useMutation<
    PopulatedFlow,
    Error,
    void
  >({
    mutationFn: async () => {
      const projectId = authenticationSession.getProjectId()!;
      const folder = await folderName?.();
      
      return flowsApi.create({
        projectId,
        displayName: t('Untitled'),
        folderName: folder,
      });
    },
    onSuccess: (flow) => {
      onSuccess(flow);
      setIsOpen(false);
    },
    onError: () => toast(INTERNAL_ERROR_TOAST),
  });

  const handleStart = () => {
    if (prompt.trim()) {
      buildWithInvent(prompt);
    }
  };

  const handleImportSuccess = () => {
    setIsOpen(false);
    setIsImportDialogOpen(false);
  };

  const handleTemplateSuccess = () => {
    setIsOpen(false);
    setIsTemplateDialogOpen(false);
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[600px] p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-xl font-semibold">
              {t('Build with Invent')}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {t("Describe what do you want your tool to do and we'll build it for you")}
            </p>
          </DialogHeader>

          <div className="px-6 pb-6">
            <div className="relative">
              <Textarea
                placeholder={t("Describe a repetitive, manual task. We'll build a tool to do it...")}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px] pr-20 border-2 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                disabled={isBuilding}
              />
              <Button
                onClick={handleStart}
                disabled={!prompt.trim() || isBuilding}
                className="absolute bottom-3 right-3 bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 h-auto"
                size="sm"
              >
                {isBuilding ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    {t('Building...')}
                  </>
                ) : (
                  <>
                    {t('Start')}
                    <span className="ml-2 text-xs">⌘⏎</span>
                  </>
                )}
              </Button>
            </div>

            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">{t('Or choose a starting point')}</h3>
                <ImportFlowDialog
                  insideBuilder={false}
                  onRefresh={() => {
                    setIsOpen(false);
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {t('Import')}
                  </Button>
                </ImportFlowDialog>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <SelectFlowTemplateDialog>
                  <div className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                      <Workflow className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{t('Clone a Tool template')}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('Choose an existing template to configure')}
                      </p>
                    </div>
                  </div>
                </SelectFlowTemplateDialog>

                <div
                  className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => createFromScratch()}
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{t('Build from scratch')}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('Connect integrations and LLMs to build an AI workflow for your agent')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};