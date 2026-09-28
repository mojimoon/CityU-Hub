import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, ExternalLink, GitFork, Scale, Star } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { GitHubIcon } from '../components/GitHubIcon';
import { Header } from '../components/Header';
import { SkeletonCard } from '../components/SkeletonCard';
import { TagChips } from '../components/TagChips';
import { useProject } from '../hooks/useProjects';
import { formatNumber, formatRelativeTime } from '../utils/formatNumber';
import { languageColor } from '../utils/language';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { project, loading, error } = useProject(id);

  useEffect(() => {
    if (!project) return;
    document.title = `${project.name} · CityU Hub`;
    return () => {
      document.title = 'CityU Hub';
    };
  }, [project]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <button type="button" onClick={goBack} className="btn-brutal btn-brutal-secondary">
          <ArrowLeft className="size-4" />
          BACK
        </button>

        {loading && (
          <div className="mt-6 grid gap-6">
            <SkeletonCard />
          </div>
        )}

        {!loading && (error || !project) && (
          <div className="mt-6">
            <EmptyState
              title="未找到该项目"
              description={error ?? '项目可能已被移除，或链接有误。'}
              actionLabel="返回首页"
              onAction={() => navigate('/')}
            />
          </div>
        )}

        {!loading && project && (
          <>
            <article className="panel-brutal mt-6 p-6">
              <div className="flex items-center gap-2">
                {project.authorAvatar ? (
                  <img
                    src={project.authorAvatar}
                    alt={`${project.authorName || project.author} 的头像`}
                    loading="lazy"
                    width={28}
                    height={28}
                    className="size-7 border-2 border-line bg-elevated object-cover"
                  />
                ) : (
                  <span className="pixel grid size-7 shrink-0 place-items-center border-2 border-line bg-elevated text-[8px] text-ink uppercase">
                    {project.author.slice(0, 1)}
                  </span>
                )}
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="mono truncate text-[12px] text-ink">{project.author}</span>
                  {(() => {
                    const meta = [
                      project.authorName && project.authorName !== project.author
                        ? project.authorName
                        : '',
                      project.major,
                      project.enrollmentYear ? `${project.enrollmentYear} 级` : '',
                    ].filter(Boolean);
                    if (meta.length === 0) return null;
                    return (
                      <span className="mono truncate text-[11px] text-muted">
                        {meta.join(' · ')}
                      </span>
                    );
                  })()}
                </span>
                <span className="mono text-[12px] text-muted">//</span>
                <Link
                  to={`/?q=author:${encodeURIComponent(project.author)}`}
                  className="mono text-[12px] text-muted hover:text-brand"
                >
                  {project.repo}
                </Link>
                <span className="pixel ml-auto border-2 border-accent px-2 py-1 text-[8px] text-accent">
                  SRC
                </span>
              </div>

              <h1 className="glitch mt-4 text-3xl font-black tracking-tight text-ink">
                {project.name}
              </h1>
              <p className="mono mt-3 text-[13px] leading-6 text-muted">{project.description}</p>

              {(project.authorName || project.major || project.enrollmentYear) && (
                <dl className="mono mt-4 grid gap-2 border-l-4 border-brand pl-3 text-[12px] text-muted sm:grid-cols-3">
                  {project.authorName && (
                    <div>
                      <dt className="text-[10px] text-ink">姓名</dt>
                      <dd>{project.authorName}</dd>
                    </div>
                  )}
                  {project.major && (
                    <div>
                      <dt className="text-[10px] text-ink">专业</dt>
                      <dd>{project.major}</dd>
                    </div>
                  )}
                  {project.enrollmentYear && (
                    <div>
                      <dt className="text-[10px] text-ink">入学年份</dt>
                      <dd>{project.enrollmentYear}</dd>
                    </div>
                  )}
                </dl>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-brutal btn-brutal-primary"
                >
                  <GitHubIcon className="size-4" />
                  GITHUB
                </a>
                {project.demoUrl && (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-brutal btn-brutal-secondary"
                  >
                    <ExternalLink className="size-4" />
                    DEMO
                  </a>
                )}
              </div>

              <dl className="mono mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-t-[3px] border-line pt-4 text-[12px] text-muted sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Star className="size-3.5 text-brand" />
                  <dt className="sr-only">Stars</dt>
                  <dd className="text-brand tabular-nums">{formatNumber(project.stars)} stars</dd>
                </div>
                <div className="flex items-center gap-2">
                  <GitFork className="size-3.5" />
                  <dt className="sr-only">Forks</dt>
                  <dd className="tabular-nums">{formatNumber(project.forks)} forks</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Scale className="size-3.5" />
                  <dt className="sr-only">License</dt>
                  <dd>{project.license || '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 border border-line"
                    style={{ backgroundColor: languageColor(project.language) }}
                  />
                  <dt className="sr-only">Language</dt>
                  <dd>{project.language || '—'}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5" />
                  <dt className="sr-only">创建时间</dt>
                  <dd>创建于 {project.createdAt}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5" />
                  <dt className="sr-only">更新时间</dt>
                  <dd>更新于 {formatRelativeTime(project.updatedAt)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border-2 border-line px-2 py-0.5">{project.category}</span>
                </div>
              </dl>

              <div className="mt-5 border-t-[3px] border-line pt-5">
                <TagChips items={project.tags} size="md" />
              </div>
            </article>

            <section className="panel-brutal mt-6 p-6 sm:p-8">
              <h2 className="pixel flex items-center gap-3 text-[10px] text-muted">
                <span className="size-3 bg-brand" />
                README.md
              </h2>
              <div
                className="prose-readme mt-5"
                // README 由 repos-parser 渲染并做过白名单消毒，这里可以直接注入
                dangerouslySetInnerHTML={{
                  __html: project.readmeHtml ?? '<p>该项目暂无 README 内容。</p>',
                }}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
