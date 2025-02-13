import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { CodeBlock } from "@/components/ui/code-block";

export default function Home() {
  const code = `const DummyComponent = () => {
  const [count, setCount] = React.useState(0);
 
  const handleClick = () => {
    setCount(prev => prev + 1);
  };
 
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Fights Counter</h2>
      <p className="mb-2">Fight Club Fights Count: {count}</p>
      <button 
        onClick={handleClick}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Increment
      </button>
    </div>
  );
};
`;
  return (
    <div className="flex h-screen items-center justify-center">
      <ResizablePanelGroup
        direction="horizontal"
        className="max-w-[95%] rounded-xl border md:min-w-[450px] max-h-[95%] shadow-md"
      >
        <ResizablePanel defaultSize={50}>
          <div className="flex h-[200px] items-center justify-center p-6">
            <span className="font-semibold">One</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <div className="h-full bg-slate-900">
            <CodeBlock
              language="c"
              filename="HardConfig.c"
              highlightLines={[9, 13, 14, 18]}
              code={code}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
