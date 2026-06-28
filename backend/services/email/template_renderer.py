import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

# Resolve templates path relative to this file
# This file: backend/services/email/template_renderer.py -> parent: email/ -> parent: services/ -> parent: backend/
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATES_DIR = os.path.join(BACKEND_DIR, "templates")

class EmailTemplateError(Exception):
    """Exception raised when template rendering fails or a template is not found."""
    pass

class TemplateRenderer:
    def __init__(self, templates_dir: str = TEMPLATES_DIR):
        self.templates_dir = templates_dir
        if not os.path.isdir(self.templates_dir):
            raise EmailTemplateError(f"Templates directory not found at: {self.templates_dir}")
        self.env = Environment(loader=FileSystemLoader(self.templates_dir))

    def render(self, template_name: str, context: dict = None) -> str:
        """
        Renders an HTML email template with the provided context.
        
        Args:
            template_name: Path to the template relative to the templates folder (e.g. 'emails/welcome.html').
            context: Dictionary of values to interpolate into the template.
            
        Returns:
            The rendered HTML string.
            
        Raises:
            EmailTemplateError: If the template was not found or failed to render.
        """
        if context is None:
            context = {}

        # Inject global defaults if not specified
        context.setdefault("company_name", "Invoice Digital Viyabari")
        context.setdefault("logo_url", "https://digitalviyabari.com/logo.png")
        context.setdefault("current_year", str(datetime.now().year))

        try:
            template = self.env.get_template(template_name)
            return template.render(**context)
        except TemplateNotFound as e:
            raise EmailTemplateError(f"Template '{template_name}' could not be found in {self.templates_dir}") from e
        except Exception as e:
            raise EmailTemplateError(f"Error rendering template '{template_name}': {str(e)}") from e
