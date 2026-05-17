'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ImageIcon, FileText, X, Upload, CheckCircle2 } from 'lucide-react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { Course, CourseType } from '@/lib/db';
import { createCourse, updateCourse } from '@/lib/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Course | null;
  ownerId: string;
  ownerName?: string;
  onSaved: () => void;
}

const TYPES: { id: CourseType; label: string }[] = [
  { id: 'course', label: 'Course' },
  { id: 'ebook', label: 'eBook' },
  { id: 'exam', label: 'Exam Paper' },
  { id: 'solutions', label: 'Exam Solutions' },
  { id: 'paper', label: 'Past Paper' },
  { id: 'bundle', label: 'Bundle' },
];

const CATEGORIES = [
  'Mathematics', 'Science', 'English', 'History', 'Languages',
  'Art', 'Technology', 'Business', 'Music', 'Other',
];

const LEVELS = ['All', 'Primary', 'Secondary', 'GCSE', 'A-Level', 'University'];

async function uploadFile(
  file: File,
  path: string,
  onProgress?: (p: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);
    task.on(
      'state_changed',
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

export default function CourseEditorModal({
  open, onOpenChange, initial, ownerId, ownerName, onSaved,
}: Props) {
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Tab 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CourseType>('course');
  const [category, setCategory] = useState('Mathematics');
  const [subject, setSubject] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [thumbUploadPct, setThumbUploadPct] = useState(0);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Tab 2
  const [level, setLevel] = useState('All');
  const [price, setPrice] = useState<string>('0');
  const [currency, setCurrency] = useState('GBP');
  const [whatYouLearn, setWhatYouLearn] = useState('');
  const [requirements, setRequirements] = useState('');
  const [tags, setTags] = useState('');
  const [durationHours, setDurationHours] = useState<string>('');

  // Tab 3
  const [workbookUrl, setWorkbookUrl] = useState('');
  const [workbookFile, setWorkbookFile] = useState<File | null>(null);
  const [workbookFileName, setWorkbookFileName] = useState('');
  const [wbUploadPct, setWbUploadPct] = useState(0);
  const wbInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setType((initial.type as CourseType) ?? 'course');
      setCategory(initial.category ?? 'Mathematics');
      setSubject(initial.subject ?? '');
      setThumbnailUrl(initial.thumbnailUrl ?? '');
      setThumbnailPreview(initial.thumbnailUrl ?? '');
      setThumbnailFile(null);
      setLevel(initial.level ?? 'All');
      setPrice(String(initial.price ?? 0));
      setCurrency(initial.currency ?? 'GBP');
      setWhatYouLearn((initial.whatYouLearn ?? []).join('\n'));
      setRequirements((initial.requirements ?? []).join('\n'));
      setTags((initial.tags ?? []).join(', '));
      setWorkbookUrl(initial.workbookUrl ?? '');
      setWorkbookFile(null);
      setWorkbookFileName(initial.workbookUrl ? 'Current workbook' : '');
      setPreviewUrl(initial.previewUrl ?? '');
      setDurationHours(initial.durationHours ? String(initial.durationHours) : '');
      setIsPublic(initial.isPublic ?? true);
    } else {
      setTitle(''); setDescription(''); setType('course'); setCategory('Mathematics');
      setSubject(''); setThumbnailUrl(''); setThumbnailPreview(''); setThumbnailFile(null);
      setLevel('All'); setPrice('0'); setCurrency('GBP'); setWhatYouLearn('');
      setRequirements(''); setTags(''); setWorkbookUrl(''); setWorkbookFile(null);
      setWorkbookFileName(''); setPreviewUrl(''); setDurationHours(''); setIsPublic(true);
    }
    setThumbUploadPct(0);
    setWbUploadPct(0);
    setActiveTab('basic');
  }, [open, initial]);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
    setThumbUploadPct(0);
  };

  const handleWorkbookChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWorkbookFile(file);
    setWorkbookFileName(file.name);
    setWbUploadPct(0);
  };

  const save = async (publish: boolean) => {
    if (!title.trim()) { toast.error('Title is required.'); setActiveTab('basic'); return; }
    if (!description.trim()) { toast.error('Description is required.'); setActiveTab('basic'); return; }

    let finalThumbnailUrl = thumbnailUrl;
    let finalWorkbookUrl = workbookUrl;

    try {
      setSaving(true);

      // Upload thumbnail if a file was selected
      if (thumbnailFile) {
        const path = `courses/${ownerId}/thumbnails/${Date.now()}-${thumbnailFile.name}`;
        finalThumbnailUrl = await uploadFile(thumbnailFile, path, setThumbUploadPct);
      }

      // Upload workbook PDF if a file was selected
      if (workbookFile) {
        const path = `courses/${ownerId}/workbooks/${Date.now()}-${workbookFile.name}`;
        finalWorkbookUrl = await uploadFile(workbookFile, path, setWbUploadPct);
      }

      const payload: Omit<Course, 'id'> = {
        title: title.trim(),
        description: description.trim(),
        ownerId,
        ownerName,
        thumbnailUrl: finalThumbnailUrl.trim() || undefined,
        status: publish ? 'published' : 'draft',
        subject: subject.trim() || undefined,
        type,
        category,
        level,
        price: Number(price) || 0,
        currency: currency.trim() || 'GBP',
        isPublic,
        whatYouLearn: whatYouLearn.split('\n').map(s => s.trim()).filter(Boolean),
        requirements: requirements.split('\n').map(s => s.trim()).filter(Boolean),
        tags: tags.split(',').map(s => s.trim()).filter(Boolean),
        workbookUrl: finalWorkbookUrl.trim() || undefined,
        previewUrl: previewUrl.trim() || undefined,
        durationHours: durationHours ? Number(durationHours) : undefined,
      };

      if (initial?.id) {
        await updateCourse(initial.id, payload);
        toast.success('Course updated.');
      } else {
        await createCourse(payload);
        toast.success(publish ? 'Course published.' : 'Draft saved.');
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  const learnBullets = whatYouLearn.split('\n').map(s => s.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Product' : 'Create New Product'}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="basic">1. Basic</TabsTrigger>
            <TabsTrigger value="details">2. Details</TabsTrigger>
            <TabsTrigger value="content">3. Content</TabsTrigger>
            <TabsTrigger value="review">4. Review</TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Basic ─────────────────────────────────────── */}
          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ce-title">Title *</Label>
              <Input id="ce-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GCSE Biology — Cell Respiration" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-desc">Description *</Label>
              <Textarea id="ce-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this product about?" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => v && setType(v as CourseType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-subject">Subject (optional)</Label>
              <Input id="ce-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Biology" />
            </div>

            {/* Thumbnail upload */}
            <div className="space-y-2">
              <Label>Course Thumbnail</Label>
              <div
                className="relative rounded-xl border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => thumbInputRef.current?.click()}
              >
                {thumbnailPreview ? (
                  <div className="relative group">
                    <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-48 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-semibold flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Change thumbnail
                      </span>
                    </div>
                    <button
                      type="button"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      onClick={e => { e.stopPropagation(); setThumbnailPreview(''); setThumbnailFile(null); setThumbnailUrl(''); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="w-10 h-10" />
                    <span className="text-sm font-medium">Click to upload thumbnail</span>
                    <span className="text-xs">PNG, JPG, WebP — recommended 1280×720</span>
                  </div>
                )}
                {thumbUploadPct > 0 && thumbUploadPct < 100 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-muted">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${thumbUploadPct}%` }} />
                  </div>
                )}
              </div>
              <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
            </div>
          </TabsContent>

          {/* ── Tab 2: Details ───────────────────────────────────── */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={level} onValueChange={(v) => v && setLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-dur">Duration (hours, optional)</Label>
                <Input id="ce-dur" type="number" min="0" step="0.5" value={durationHours} onChange={e => setDurationHours(e.target.value)} placeholder="e.g. 12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ce-price">Price (0 = free)</Label>
                <Input id="ce-price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-learn">What learners will gain (one point per line)</Label>
              <Textarea id="ce-learn" value={whatYouLearn} onChange={e => setWhatYouLearn(e.target.value)} rows={5} placeholder={'Understand cell respiration step by step\nApply the ATP cycle to exam questions\nConfidently answer 6-mark questions\n…'} />
              <p className="text-xs text-muted-foreground">These appear as bullet points on your course listing page.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-req">Requirements / prerequisites (one per line)</Label>
              <Textarea id="ce-req" value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} placeholder={'Basic GCSE biology\nA notebook and pen'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-tags">Tags (comma-separated)</Label>
              <Input id="ce-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="GCSE, biology, revision" />
            </div>
          </TabsContent>

          {/* ── Tab 3: Content ───────────────────────────────────── */}
          <TabsContent value="content" className="space-y-5">
            {/* Workbook / PDF upload */}
            <div className="space-y-2">
              <Label>Workbook / PDF (optional)</Label>
              <p className="text-xs text-muted-foreground">Available to buyers / enrolled students after purchase. Upload a PDF workbook or past paper.</p>
              <div
                className="rounded-xl border-2 border-dashed border-border p-6 cursor-pointer hover:border-blue-400 transition-colors text-center"
                onClick={() => wbInputRef.current?.click()}
              >
                {workbookFileName ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-blue-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{workbookFileName}</p>
                      <p className="text-xs text-muted-foreground">Click to replace</p>
                    </div>
                    <button
                      type="button"
                      className="ml-auto w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
                      onClick={e => { e.stopPropagation(); setWorkbookFile(null); setWorkbookFileName(''); setWorkbookUrl(''); }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="w-10 h-10" />
                    <span className="text-sm font-medium">Click to upload PDF workbook</span>
                    <span className="text-xs">PDF files only</span>
                  </div>
                )}
                {wbUploadPct > 0 && wbUploadPct < 100 && (
                  <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${wbUploadPct}%` }} />
                  </div>
                )}
              </div>
              <input ref={wbInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleWorkbookChange} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ce-prev">Free preview URL (optional)</Label>
              <Input id="ce-prev" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} placeholder="https://… (video or PDF preview visible to all)" />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Public marketplace listing</p>
                <p className="text-xs text-muted-foreground">Visible on the public /courses page. Final listing requires admin approval.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </TabsContent>

          {/* ── Tab 4: Review & Publish ──────────────────────────── */}
          <TabsContent value="review" className="space-y-4">
            <div className="rounded-2xl border border-border overflow-hidden">
              {/* Thumbnail preview */}
              {thumbnailPreview && (
                <img src={thumbnailPreview} alt="Thumbnail" className="w-full h-52 object-cover" />
              )}
              {!thumbnailPreview && (
                <div className="w-full h-52 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  <ImageIcon className="w-14 h-14 text-blue-300" />
                </div>
              )}

              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">{type}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">{level}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">{category}</span>
                </div>
                <h3 className="text-xl font-bold text-foreground">{title || <span className="text-muted-foreground italic">No title yet</span>}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{description || <span className="italic">No description yet</span>}</p>

                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-foreground">
                    {Number(price) === 0 ? 'Free' : `${currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}${Number(price).toFixed(2)}`}
                  </span>
                  {durationHours && <span className="text-muted-foreground">{durationHours}h content</span>}
                  {isPublic && <span className="text-blue-600 text-xs font-medium">Marketplace listing</span>}
                </div>

                {learnBullets.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">What you&apos;ll gain</p>
                    <ul className="space-y-1.5">
                      {learnBullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {workbookFileName && (
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <FileText className="w-4 h-4" />
                    <span>{workbookFileName}</span>
                    <span className="text-xs text-muted-foreground">(workbook included)</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <strong>Note:</strong> After saving, use &quot;Submit for Review&quot; from your dashboard. An admin will approve before it appears on the public marketplace.
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save as draft'}
              </Button>
              <Button onClick={() => save(false)} disabled={saving} className="bg-google-blue hover:bg-[#1967D2] text-white">
                {saving ? 'Saving…' : 'Save & Review later'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
